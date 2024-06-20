import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MY_EMAIL,
    pass: process.env.MY_EMAIL_PASSWORD,
  },
});

const sendMail = async (to, subject, text, ...rest) => {
  const mailOptions = {
    from: process.env.MY_EMAIL,
    to,
    subject,
    text,
    ...rest,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    return error;
  }
};

export default sendMail;
