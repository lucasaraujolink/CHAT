# Usa uma imagem leve do Node.js 20
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de definição de dependências
COPY package*.json ./

# Instala TODAS as dependências (incluindo as de desenvolvimento necessárias para o build do Vite)
RUN npm install

# Copia todo o código fonte do projeto para dentro do container
COPY . .

# Argumento de build para garantir que variáveis de ambiente possam ser lidas se passadas
ARG API_KEY
ENV API_KEY=$API_KEY

# Executa o build do Frontend (Gera a pasta 'dist' otimizada)
RUN npm run build

# Expõe a porta 3001 onde o servidor backend roda
EXPOSE 3001

# Comando para iniciar a aplicação (Backend servindo o Frontend)
CMD ["npm", "start"]
