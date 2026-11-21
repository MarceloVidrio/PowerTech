require("dotenv").config();

const { enviarCorreo } = require("./utils/mailer");

async function probarCorreo() {
  try {
    await enviarCorreo({
      para: "claudiaoley19@gmail.com",
      asunto: "Prueba de correo - PowerTech",
      texto: "Este es un correo de prueba enviado desde PowerTech.",
      html: `
        <h2>PowerTech</h2>
        <p>Este es un correo de prueba.</p>
        <p>El sistema de recuperación de contraseña está siendo configurado correctamente.</p>
      `
    });

    console.log("Correo enviado correctamente.");
  } catch (error) {
    console.error("Error al enviar el correo:");
    console.error(error);
  }
}

probarCorreo();
