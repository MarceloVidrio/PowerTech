require("../config/env");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function enviarCorreo({ para, asunto, texto, html }) {
  const info = await transporter.sendMail({
    from: `"PowerTech" <${process.env.EMAIL_USER}>`,
    to: para,
    subject: asunto,
    text: texto,
    html: html
  });

  return info;
}

module.exports = {
  transporter,
  enviarCorreo
};