FROM busybox:latest

WORKDIR /app

COPY src/ . 

CMD ["httpd", "-f", "-p", "80", "-h", "/app"]
