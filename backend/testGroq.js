require('dotenv').config();

const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function probarGroq() {
    try {
        console.log('Conectando con Groq...');

        const respuesta = await groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages: [
                {
                    role: 'user',
                    content: 'Responde solamente: PowerBot conectado correctamente.'
                }
            ],
            temperature: 0.3
        });

        console.log('Respuesta de Groq:');
        console.log(respuesta.choices[0].message.content);

    } catch (error) {
        console.error('ERROR DE GROQ:');
        console.error(error.message);
    }
}

probarGroq();