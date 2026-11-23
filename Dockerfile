# NestNavigator - RentRight. Needs Node 22.5+ (built-in node:sqlite); there are no runtime npm dependencies.
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/nestnavigator.sqlite BACKUP_DIR=/app/backups
WORKDIR /app
# Only application files are copied (see .dockerignore): no tests, data, backups or secrets.
COPY package.json server.js app.js index.html style.css ./
COPY lib ./lib
COPY middleware ./middleware
COPY repositories ./repositories
COPY services ./services
COPY controllers ./controllers
COPY routes ./routes
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p data backups && chown -R node:node /app
USER node
EXPOSE 3000
VOLUME ["/app/data", "/app/backups"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
