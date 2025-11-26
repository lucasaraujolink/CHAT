# Usa uma imagem estável do Node.js
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependência primeiro (para cache do Docker)
COPY package*.json ./

# Instala TODAS as dependências (dev + prod) necessárias para o build
# O cache clean força a atualização dos tipos
RUN npm cache clean --force && npm install

# Copia o restante do código
COPY . .

# Variável de ambiente para o build time
ARG API_KEY
ENV API_KEY=$API_KEY

# Executa o build do React (Gera a pasta 'dist')
RUN npm run build

# Remove dependências de dev para deixar a imagem final mais leve (opcional, mas recomendado)
# RUN npm prune --production 

# Expõe a porta do servidor
EXPOSE 3001

# Inicia o servidor Node
CMD ["npm", "start"]
