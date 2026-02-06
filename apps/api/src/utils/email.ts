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
    html: `<a href="${link}">Verify Email</a>`,
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
