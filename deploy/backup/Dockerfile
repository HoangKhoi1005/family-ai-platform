FROM postgres:17.6-alpine
RUN apk add --no-cache age aws-cli ca-certificates \
  && mkdir -p /work /run/secrets \
  && chown postgres:postgres /work
COPY --chmod=0555 deploy/scripts/backup-postgres.sh /usr/local/bin/backup-postgres
COPY --chmod=0555 deploy/scripts/restore-postgres.sh /usr/local/bin/restore-postgres
USER postgres
WORKDIR /work
ENTRYPOINT ["backup-postgres"]
