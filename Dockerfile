# Usa imagem leve do Node.js 20
FROM node:20-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala todas as dependências (produção + dev)
RUN npm cache clean --force && npm install

# Copia todo o código fonte
COPY . .

# Evita warnings de secrets: API_KEY será lida via variável de ambiente no painel
# ARG API_KEY
# ENV API_KEY=$API_KEY

# Executa build do React/Vite
RUN npm run build

# Porta que o container vai escutar
# Easypanel geralmente fornece a variável PORT, então usamos ela
ENV PORT=80
EXPOSE $PORT

# Comando para iniciar o servidor Node
CMD ["node", "server.js"]
