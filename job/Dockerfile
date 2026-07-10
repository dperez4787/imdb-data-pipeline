FROM node:24-slim

# mongoimport comes from mongodb-database-tools; pinned version, verified deb.
ARG DB_TOOLS_VERSION=100.12.2
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget \
 && wget -q "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-${DB_TOOLS_VERSION}.deb" \
 && apt-get install -y "./mongodb-database-tools-debian12-x86_64-${DB_TOOLS_VERSION}.deb" \
 && rm -f "mongodb-database-tools-debian12-x86_64-${DB_TOOLS_VERSION}.deb" \
 && apt-get purge -y wget \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

USER node
CMD ["node", "src/index.js"]
