FROM node:erbium-slim
RUN apt-get update || : && apt-get install python make g++ -y
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run builds
EXPOSE 3000
CMD [ "npm", "start" ]