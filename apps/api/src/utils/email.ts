import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (to: string, link: string) => {
  await transporter.sendMail({
    from: `"TestTrack Pro" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your TestTrack Pro account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Verify your email</h2>
        <p style="margin: 0 0 16px;">Click the button below to activate your account.</p>
        <a
          href="${link}"
          style="
            display: inline-block;
            padding: 10px 18px;
            background: #0b63f6;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
          "
        >
          Verify
        </a>
        <p style="margin: 16px 0 0; font-size: 12px; color: #555;">
          If the button does not work, open this link:
          <br />
          <a href="${link}">${link}</a>
        </p>
      </div>
    `,
  });
};

export const sendResetEmail = async (to: string, link: string) => {
  await transporter.sendMail({
    from: `"TestTrack Pro" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Reset your password",
    html: `<a href="${link}">Reset Password</a>`,
  });
};
