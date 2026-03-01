$ErrorActionPreference = "Stop"

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [string]$Token = $null
  )

  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }

  try {
    $params = @{
      Uri = $Url
      Method = $Method
      Headers = $headers
      ErrorAction = "Stop"
    }
    if ($Body -ne $null) {
      $params["ContentType"] = "application/json"
      $params["Body"] = ($Body | ConvertTo-Json -Depth 20)
    }
    $resp = Invoke-RestMethod @params
    return [pscustomobject]@{ StatusCode = 200; Body = $resp }
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $content = $reader.ReadToEnd()
      $json = $null
      try { $json = $content | ConvertFrom-Json -ErrorAction Stop } catch { $json = $content }
      return [pscustomobject]@{ StatusCode = $status; Body = $json }
    }
    return [pscustomobject]@{ StatusCode = 0; Body = $_.Exception.Message }
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Name, [string]$Detail = "")
  if ($Condition) {
    Write-Output "PASS|$Name|$Detail"
  } else {
    Write-Output "FAIL|$Name|$Detail"
  }
}

$health = Invoke-Api -Method GET -Url "http://localhost:4000/"
Assert-True ($health.StatusCode -eq 200) "SERVER_UP" "status=$($health.StatusCode)"

$suffix = [guid]::NewGuid().ToString("N").Substring(0, 8)
$email = "suite.fr.$suffix@example.com"
$password = "Strong@1234"
$apiRoot = "http://localhost:4000/api"

$reg = Invoke-Api -Method POST -Url "$apiRoot/auth/register" -Body @{ name = "Suite FR Tester"; email = $email; password = $password; role = "TESTER" }
Assert-True ($reg.StatusCode -eq 200 -or $reg.StatusCode -eq 201) "AUTH_REGISTER" "status=$($reg.StatusCode)"

@'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  await prisma.user.update({
    where: { email: process.argv[2] },
    data: { isVerified: true, verificationToken: null, verificationExpiry: null },
  });
  await prisma.$disconnect();
})();
'@ | Set-Content -NoNewline tmp-verify-user.js
node tmp-verify-user.js $email | Out-Null

$login = Invoke-Api -Method POST -Url "$apiRoot/auth/login" -Body @{ email = $email; password = $password }
Assert-True ($login.StatusCode -eq 200 -and $null -ne $login.Body.accessToken) "AUTH_LOGIN" "status=$($login.StatusCode)"
$token = $login.Body.accessToken

$steps = @(
  @{ stepNumber = 1; action = "Open page"; testData = "N/A"; expectedResult = "Page opens" },
  @{ stepNumber = 2; action = "Submit credentials"; testData = "valid user"; expectedResult = "Login success" }
)

$createdCases = @()
foreach ($i in 1..4) {
  $tc = Invoke-Api -Method POST -Url "$apiRoot/testcases" -Token $token -Body @{
    title = "FR Suite Case $i $suffix"
    description = "Suite FR validation case $i"
    preConditions = @("user exists")
    testDataRequirements = @("credentials")
    environmentRequirements = @("staging")
    steps = $steps
    postConditions = @("session closed")
    module = "Authentication"
    priority = "MEDIUM"
    severity = "MAJOR"
    type = "FUNCTIONAL"
    status = "READY"
    tags = @("fr", "suite")
  }
  Assert-True ($tc.StatusCode -eq 200 -and $null -ne $tc.Body.id) "CREATE_TESTCASE_$i" "status=$($tc.StatusCode)"
  $createdCases += $tc.Body
}

$parent = Invoke-Api -Method POST -Url "$apiRoot/suites" -Token $token -Body @{
  name = "User Authentication Suite $suffix"
  description = "Parent auth suite"
  module = "Authentication"
  testCaseIds = @($createdCases[0].id, $createdCases[1].id)
}
Assert-True ($parent.StatusCode -eq 200 -and $null -ne $parent.Body.id) "FR-TS-001_CREATE_PARENT_SUITE" "status=$($parent.StatusCode)"
$parentId = $parent.Body.id

$child = Invoke-Api -Method POST -Url "$apiRoot/suites" -Token $token -Body @{
  name = "Auth Child Suite $suffix"
  description = "Child auth suite"
  module = "Authentication"
  parentSuiteId = $parentId
  testCaseIds = @($createdCases[2].id)
}
Assert-True ($child.StatusCode -eq 200 -and $child.Body.parentSuiteId -eq $parentId) "FR-TS-001_HIERARCHICAL_SUITE" "status=$($child.StatusCode)"

$parentGet = Invoke-Api -Method GET -Url "$apiRoot/suites/$parentId" -Token $token
$metaOk = $parentGet.StatusCode -eq 200 -and $parentGet.Body.name -like "User Authentication Suite*" -and $parentGet.Body.module -eq "Authentication" -and $parentGet.Body._count.suiteCases -ge 2 -and $parentGet.Body.childSuites.Count -ge 1
Assert-True $metaOk "FR-TS-001_METADATA_AND_GROUPING" "cases=$($parentGet.Body._count.suiteCases) child=$($parentGet.Body.childSuites.Count)"

$addCases = Invoke-Api -Method POST -Url "$apiRoot/suites/$parentId/testcases" -Token $token -Body @{ testCaseIds = @($createdCases[2].id, $createdCases[3].id) }
Assert-True ($addCases.StatusCode -eq 200) "FR-TS-003_ADD_CASES" "status=$($addCases.StatusCode)"

$removeCase = Invoke-Api -Method DELETE -Url "$apiRoot/suites/$parentId/testcases/$($createdCases[1].id)" -Token $token
Assert-True ($removeCase.StatusCode -eq 200) "FR-TS-003_REMOVE_CASE" "status=$($removeCase.StatusCode)"

$orderedIds = @($createdCases[2].id, $createdCases[0].id, $createdCases[3].id)
$reorder = Invoke-Api -Method PATCH -Url "$apiRoot/suites/$parentId/testcases/reorder" -Token $token -Body @{ testCaseIds = $orderedIds }
Assert-True ($reorder.StatusCode -eq 200) "FR-TS-003_REORDER_CASES" "status=$($reorder.StatusCode)"

$clone = Invoke-Api -Method POST -Url "$apiRoot/suites/$parentId/clone" -Token $token -Body @{ name = "Regression Suite Clone $suffix" }
Assert-True ($clone.StatusCode -eq 200 -and $null -ne $clone.Body.id) "FR-TS-003_CLONE_SUITE" "status=$($clone.StatusCode)"

$archive = Invoke-Api -Method POST -Url "$apiRoot/suites/$($child.Body.id)/archive" -Token $token
$restore = Invoke-Api -Method POST -Url "$apiRoot/suites/$($child.Body.id)/restore" -Token $token
Assert-True ($archive.StatusCode -eq 200 -and $restore.StatusCode -eq 200) "FR-TS-003_ARCHIVE_RESTORE" "archive=$($archive.StatusCode),restore=$($restore.StatusCode)"

$seqExec = Invoke-Api -Method POST -Url "$apiRoot/suite-executions" -Token $token -Body @{ suiteId = $parentId; mode = "SEQUENTIAL" }
Assert-True ($seqExec.StatusCode -eq 200 -and $seqExec.Body.mode -eq "SEQUENTIAL") "FR-TS-002_START_SEQUENTIAL_EXEC" "status=$($seqExec.StatusCode)"

$seqExecDetail = Invoke-Api -Method GET -Url "$apiRoot/suite-executions/$($seqExec.Body.id)" -Token $token
$seqRunId = $seqExecDetail.Body.linkedTestRun.id
$seqCase2 = $seqExecDetail.Body.cases[1].testCaseId
$seqCase1 = $seqExecDetail.Body.cases[0].testCaseId
$seqCase3 = $seqExecDetail.Body.cases[2].testCaseId

$seqOutOfOrder = Invoke-Api -Method POST -Url "$apiRoot/testcases/$seqCase2/execute" -Token $token -Body @{ result = "PASSED"; testRunId = $seqRunId }
Assert-True ($seqOutOfOrder.StatusCode -eq 409) "FR-TS-002_SEQUENTIAL_CONSTRAINT" "status=$($seqOutOfOrder.StatusCode)"

$exec1 = Invoke-Api -Method POST -Url "$apiRoot/testcases/$seqCase1/execute" -Token $token -Body @{ result = "PASSED"; testRunId = $seqRunId }
$exec2 = Invoke-Api -Method POST -Url "$apiRoot/testcases/$seqCase2/execute" -Token $token -Body @{ result = "FAILED"; testRunId = $seqRunId }
$exec3 = Invoke-Api -Method POST -Url "$apiRoot/testcases/$seqCase3/execute" -Token $token -Body @{ result = "PASSED"; testRunId = $seqRunId }
Assert-True ($exec1.StatusCode -eq 200 -and $exec2.StatusCode -eq 200 -and $exec3.StatusCode -eq 200) "FR-TS-002_EXECUTE_SUITE_CASES" "first=$($exec1.StatusCode),second=$($exec2.StatusCode),third=$($exec3.StatusCode)"

$seqReport = Invoke-Api -Method GET -Url "$apiRoot/suite-executions/$($seqExec.Body.id)" -Token $token
$completedCount = ($seqReport.Body.passed + $seqReport.Body.failed + $seqReport.Body.blocked + $seqReport.Body.skipped)
$reportOk = $seqReport.StatusCode -eq 200 -and $seqReport.Body.totalCases -ge 3 -and $completedCount -eq $seqReport.Body.totalCases -and ($seqReport.Body.status -ne "RUNNING")
Assert-True $reportOk "FR-TS-002_SUITE_LEVEL_REPORT" "total=$($seqReport.Body.totalCases),passed=$($seqReport.Body.passed),failed=$($seqReport.Body.failed),status=$($seqReport.Body.status)"

$parExec = Invoke-Api -Method POST -Url "$apiRoot/suite-executions" -Token $token -Body @{ suiteId = $parentId; mode = "PARALLEL" }
Assert-True ($parExec.StatusCode -eq 200 -and $parExec.Body.mode -eq "PARALLEL") "FR-TS-002_START_PARALLEL_EXEC" "status=$($parExec.StatusCode)"

$parDetail = Invoke-Api -Method GET -Url "$apiRoot/suite-executions/$($parExec.Body.id)" -Token $token
$parRunId = $parDetail.Body.linkedTestRun.id
$parCase2 = $parDetail.Body.cases[1].testCaseId
$parExecOutOfOrder = Invoke-Api -Method POST -Url "$apiRoot/testcases/$parCase2/execute" -Token $token -Body @{ result = "PASSED"; testRunId = $parRunId }
Assert-True ($parExecOutOfOrder.StatusCode -eq 200) "FR-TS-002_PARALLEL_OUT_OF_ORDER_ALLOWED" "status=$($parExecOutOfOrder.StatusCode)"

$history = Invoke-Api -Method GET -Url "$apiRoot/suites/$parentId/executions" -Token $token
Assert-True ($history.StatusCode -eq 200 -and $history.Body.Count -ge 2) "FR-TS-002_EXECUTION_HISTORY" "count=$($history.Body.Count)"
