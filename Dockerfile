# Usa imagem leve do Node.js 20
FROM node:20-alpine

# Diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala todas as dependências (produção + dev)
RUN npm cache clean --force && npm install

# Copia todo o código fonte
COPY . .

# Build do React/Vite
RUN npm run build

# Porta do container fornecida pelo Easypanel
ENV PORT=80
EXPOSE $PORT

# Diretório para armazenar dados (DB e uploads)
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

# Comando principal: Node rodando em foreground
CMD ["node", "server.js"]
