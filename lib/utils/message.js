/**
 * @file lib/utils/message.js
 * @description Utilitários para manipulação de mensagens
 * 
 * Este módulo fornece funções para manipulação de mensagens,
 * como divisão de mensagens longas em blocos menores.
 */

/**
 * Divide uma mensagem longa em blocos menores para envio via WhatsApp
 * @param {string} text - Texto a ser dividido
 * @param {number} maxLength - Tamanho máximo de cada bloco (padrão: 1000)
 * @returns {string[]} - Array de blocos de texto
 */
function splitMessage(text, maxLength = 1000) {
  if (!text || text.length <= maxLength) return [text];
  
  const chunks = [];
  let currentChunk = "";
  const paragraphs = text.split("\n\n");
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxLength) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      if (paragraph.length > maxLength) {
        const sentences = paragraph.split(/(?<=\.|\?|\!) /);
        currentChunk = "";
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? " " : "") + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            
            if (sentence.length > maxLength) {
              let remainingSentence = sentence;
              while (remainingSentence.length > 0) {
                const chunk = remainingSentence.substring(0, maxLength);
                chunks.push(chunk);
                remainingSentence = remainingSentence.substring(maxLength);
              }
              currentChunk = "";
            } else {
              currentChunk = sentence;
            }
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Formata mensagens de boas-vindas e instruções para o usuário
 * @returns {Object} - Objeto contendo mensagens formatadas
 */
const messageTemplates = {
  welcome: (name = "") => {
    const greeting = name ? `Olá, ${name}! 👋` : "Olá! 👋";
    return `${greeting} Bem-vindo(a) ao *Conselheiro da Consciênc.IA* do evento MAPA DO LUCRO!
    
Sou um assistente virtual especial criado para gerar sua *Carta de Consciência* personalizada - uma análise única baseada no seu perfil digital que revelará insights valiosos sobre seu comportamento empreendedor e recomendações práticas para uso de IA em seus negócios.

Para começar, preciso conhecer você melhor. 

Por favor, como gostaria de ser chamado(a)?`;
  },
  
  askEmail: (name) => `Obrigado, ${name}! 😊

Para que possamos enviar materiais adicionais e manter contato após o evento, por favor, me informe seu e-mail:

(Se preferir não compartilhar seu e-mail agora, pode digitar "pular" para continuar)`,
  
  askInstagram: () => `Perfeito! Agora, para que eu possa gerar sua Carta de Consciência personalizada, preciso analisar seu perfil digital.

Por favor, me informe seu nome de usuário no Instagram (com ou sem @):

Exemplo: @consciencia.ia`,
  
  askPermission: () => `Podemos buscar informações públicas na internet (Instagram, LinkedIn etc.) para tornar sua Carta ainda mais especial? Seus dados **não** serão armazenados, apenas usados para esta experiência.

(Responda com *Sim* ou *Não*)`,
  
  generatingWithoutData: () => `Tudo bem! Não usaremos dados públicos adicionais. Estou gerando sua Carta de Consciência com base apenas nas informações fornecidas... ✨`,
  
  generatingWithData: () => `Ótimo! Vou analisar seus dados públicos e preparar sua carta. ⏳`,
  
  finalMessage: () => `Espero que tenha gostado da sua Carta de Consciência personalizada! 🌟

Para saber mais sobre como a IA pode transformar seu negócio e sua vida, conheça o *Programa Consciênc.IA* de Renato Hilel e Nuno Arcanjo.

Visite: https://www.floreon.app.br/conscienc-ia

Aproveite o evento MAPA DO LUCRO e não deixe de conversar pessoalmente com os criadores do programa! 💫`,
  
  processingQuestion: (name) => `Estou analisando sua pergunta, ${name}... 🧠`,
  
  errorMessage: (name) => `Desculpe, ${name}, estou com dificuldades para processar sua pergunta no momento. 

Por favor, tente novamente mais tarde ou visite https://www.floreon.app.br/conscienc-ia para mais informações sobre o Programa Consciênc.IA. 🙏`,
  
  resetConfirmation: () => `Sua experiência foi reiniciada. Vamos começar novamente!`
};

module.exports = {
  splitMessage,
  messageTemplates
};
