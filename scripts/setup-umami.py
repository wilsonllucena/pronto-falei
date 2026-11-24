#!/usr/bin/env python3
"""Configura o Umami (passo 11) sem imprimir segredos. Idempotente.

  python3 scripts/setup-umami.py --url http://127.0.0.1:3133 \
    --env-file ../.env --secret-file ../secrets/umami.txt --domain <dominio>

1. Na primeira vez troca a senha padrão do admin (admin/umami) por uma
   aleatória, gravada só em --secret-file (600). Depois usa essa.
2. Cria o site (--domain) se ainda não existir.
3. Grava UMAMI_WEBSITE_ID no --env-file (o id é público: vai no HTML).
Depois recrie o app pra ele ler o id: docker compose ... up -d app
"""
import argparse
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request


def call(base, path, data=None, token=None, method=None):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(data).encode() if data is not None else None,
        method=method or ("POST" if data is not None else "GET"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        body = res.read()
        return json.loads(body) if body else {}


def login(base, user, password):
    try:
        return call(base, "/api/auth/login", {"username": user, "password": password})["token"]
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403):
            return None
        raise


def read_secret(path):
    vals = {}
    with open(path) as f:
        for line in f:
            if "=" in line:
                k, v = line.rstrip("\n").split("=", 1)
                vals[k] = v
    return vals


def write_private(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), mode=0o700, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(text)
    os.chmod(path, 0o600)


def set_env(path, key, value):
    lines = open(path).read().splitlines() if os.path.exists(path) else []
    out, done = [], False
    for line in lines:
        if line.startswith(key + "="):
            out.append(f"{key}={value}")
            done = True
        else:
            out.append(line)
    if not done:
        out.append(f"{key}={value}")
    mode = os.stat(path).st_mode & 0o777 if os.path.exists(path) else 0o600
    write_private(path, "\n".join(out) + "\n")
    os.chmod(path, mode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--env-file", required=True)
    ap.add_argument("--secret-file", required=True)
    ap.add_argument("--domain", required=True)
    ap.add_argument("--name", default="Pronto, Falei!")
    a = ap.parse_args()
    base = a.url.rstrip("/")

    for _ in range(60):
        try:
            call(base, "/api/heartbeat")
            break
        except Exception:
            time.sleep(2)
    else:
        sys.exit("setup-umami: o Umami não respondeu")

    if os.path.exists(a.secret_file):
        cred = read_secret(a.secret_file)
        token = login(base, cred["usuario"], cred["senha"])
        if not token:
            sys.exit(f"setup-umami: a senha de {a.secret_file} não entrou")
    else:
        token = login(base, "admin", "umami")
        if not token:
            sys.exit("setup-umami: a senha padrão já foi trocada e não há arquivo de senha")
        new = secrets.token_urlsafe(24)
        # grava antes de trocar: se algo falhar no meio, a senha não se perde
        tmp = a.secret_file + ".novo"
        write_private(tmp, f"usuario=admin\nsenha={new}\nurl={base}\n")
        call(base, "/api/me/password", {"currentPassword": "umami", "newPassword": new}, token)
        os.replace(tmp, a.secret_file)
        token = login(base, "admin", new)
        print(f"setup-umami: senha do admin trocada (em {a.secret_file})")

    sites = call(base, "/api/websites?pageSize=200", token=token)
    sites = sites.get("data", sites) if isinstance(sites, dict) else sites
    site = next((s for s in sites if s.get("domain") == a.domain), None)
    if not site:
        site = call(base, "/api/websites", {"name": a.name, "domain": a.domain}, token)
        print(f"setup-umami: site criado pra {a.domain}")
    set_env(a.env_file, "UMAMI_WEBSITE_ID", site["id"])
    print(f"setup-umami: ok, UMAMI_WEBSITE_ID={site['id']} em {a.env_file}")


if __name__ == "__main__":
    main()
