# Nightly database backup to the Lightsail bucket.
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli tzdata
ENV TZ=Asia/Kolkata
COPY backup.sh entry.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entry.sh \
 && echo "0 3 * * * /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
# runs backup.sh every day at 03:00 India time
ENTRYPOINT ["/usr/local/bin/entry.sh"]
