FROM node:16-alpine

EXPOSE 3000
ADD . /canislupus

WORKDIR /canislupus
RUN yarn

CMD ["node", "index.js", "--trace-warnings"]