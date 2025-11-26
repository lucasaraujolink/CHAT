# Usa uma imagem leve do Node.js 20
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Limpa o cache do npm para evitar conflitos antigos e instala TUDO (produção + dev)
# Precisamos das devDependencies (como typescript e vite) para rodar o build
RUN npm cache clean --force && npm install

# Copia todo o código fonte
COPY . .

# Argumentos de build para a API Key (necessário para o Vite "assar" a chave no frontend)
ARG API_KEY
ENV API_KEY=$API_KEY

# Executa o build do React (Gera a pasta 'dist')
RUN npm run build

# Expõe a porta do servidor
EXPOSE 3001

# Comando de inicialização
CMD ["npm", "start"]
