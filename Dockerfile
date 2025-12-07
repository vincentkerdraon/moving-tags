# this will build and then serve http://127.0.0.1:8080/moving-tags/
# docker build --build-arg BASE_HREF=/moving-tags/ -t moving-tags .
# docker run --rm -p 8080:8080 moving-tags

# Build stage
FROM node:22-alpine AS build
WORKDIR /usr/src/app
ARG BASE_HREF=/
ENV BASE_HREF=${BASE_HREF}
RUN npm install -g @angular/cli
COPY moving-tags/public ./public
COPY moving-tags/src ./src
COPY moving-tags/*.json ./
RUN npm install --force && ng build --configuration production --base-href $BASE_HREF

# Nginx stage
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/dist/moving-tags/browser /usr/share/nginx/html

ARG BASE_HREF=/
ENV BASE_HREF=${BASE_HREF}
RUN sed -i "s|BASE_HREF|${BASE_HREF}|g" /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
