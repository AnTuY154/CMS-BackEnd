# dev
# FROM node:14.16.1-alpine

# WORKDIR /app

# COPY ["package.json", "package-lock.json*", "./"]

# RUN npm install --silent

# COPY . .

# RUN chown -R node:node /app

# USER node

# CMD ["npm", "run", "dev"]

# prod
FROM node:14.17.4-alpine

WORKDIR /app

RUN npm install -g pm2

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production --silent

COPY . .

RUN chown -R node:node /app

USER node

CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]

