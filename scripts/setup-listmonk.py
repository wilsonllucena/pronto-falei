#!/usr/bin/env python3
"""Configura o Listmonk (passo 13) sem imprimir segredos. Idempotente.

  python3 scripts/setup-listmonk.py --url http://127.0.0.1:3135 --env-file ../.env \
    [--secret-file ../secrets/listmonk.txt --panel-url http://<host>:3135]

Lê do --env-file: NEXT_PUBLIC_SERVER_URL, LISTMONK_ADMIN_USER/PASSWORD e o SMTP
(NEWSLETTER_SMTP_HOST, _PORT, _USER, _PASSWORD, _TLS = none|STARTTLS|TLS,
NEWSLETTER_FROM). Faz:
1. Configurações: nome, URL pública <site>/newsletter (links dos e-mails), pt-BR,
   sem rastreio, sem página pública de inscrição/arquivo do Listmonk (o
   formulário é o do blog), visual do blog nas páginas de confirmação/saída e
   o SMTP do .env. Sem SMTP fica um SMTP desligado na prática (127.0.0.1:25),
   e o compose não liga o formulário (NEWSLETTER_ENABLED vazio).
2. Na primeira vez apaga os dados de exemplo da instalação e cria a lista
   pública "Pronto, Falei!" com confirmação dupla.
3. Grava LISTMONK_LIST_UUID no --env-file (público: o app usa na inscrição).
Depois recrie o app pra ele ler a lista: docker compose ... up -d app
"""
import argparse
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

LIST_NAME = "Pronto, Falei!"
SAMPLE_LISTS = {"Default list", "Opt-in list"}
SAMPLE_EMAILS = {"john@example.com", "anon@example.com"}

PUBLIC_CSS = """
:root{--pf-paper:#FAF7F0;--pf-surface:#FFFDF8;--pf-ink:#1B1B1B;--pf-muted:#6B665E;--pf-accent:#B93D0C;--pf-border:#E6E1D6}
@media (prefers-color-scheme:dark){:root{--pf-paper:#141414;--pf-surface:#1B1B1B;--pf-ink:#EDEAE3;--pf-muted:#A8A39A;--pf-accent:#FF7A4D;--pf-border:#2A2A2A}}
body{background:var(--pf-paper);color:var(--pf-ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{background:var(--pf-surface);border:1px solid var(--pf-border);border-radius:12px;box-shadow:none}
h1,h2,h3{color:var(--pf-ink)}
a{color:var(--pf-accent)}
.button{background:var(--pf-ink);color:var(--pf-paper);border-radius:999px;border:1px solid var(--pf-ink)}
.button:hover{background:var(--pf-accent);border-color:var(--pf-accent);color:var(--pf-paper)}
.button.button-outline{background:transparent;color:var(--pf-ink);border-color:var(--pf-border)}
input[type=text],input[type=email],textarea{background:var(--pf-paper);color:var(--pf-ink);border-color:var(--pf-border)}
.logo img{max-height:40px}
footer,footer a{color:var(--pf-muted)}
""".strip()


def read_env(path):
    vals = {}
    with open(path) as f:
        for line in f:
            line = line.rstrip("\n")
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v
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


class Listmonk:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def raw(self, path, data=None, method=None, form=False, timeout=30):
        body, headers = None, {"Accept": "application/json"}
        if data is not None:
            if form:
                body = urllib.parse.urlencode(data).encode()
                headers["Content-Type"] = "application/x-www-form-urlencoded"
            else:
                body = json.dumps(data).encode()
                headers["Content-Type"] = "application/json"
        req = urllib.request.Request(
            self.base + path, data=body, headers=headers,
            method=method or ("POST" if data is not None else "GET"),
        )
        return self.http.open(req, timeout=timeout)

    def api(self, path, data=None, method=None):
        with self.raw(path, data, method) as res:
            payload = res.read()
            return json.loads(payload).get("data") if payload else None

    def wait(self, seconds=120):
        end = time.time() + seconds
        while time.time() < end:
            try:
                with self.raw("/health", timeout=5) as res:
                    if res.status == 200:
                        return
            except Exception:
                pass
            time.sleep(2)
        sys.exit("setup-listmonk: Listmonk não respondeu em /health")

    def login(self, user, password):
        with self.raw("/admin/login") as res:
            html = res.read().decode()
        m = re.search(r'name="nonce" value="([^"]+)"', html)
        form = {"nonce": m.group(1) if m else "", "next": "/admin", "username": user, "password": password}
        try:
            self.raw("/admin/login", form, form=True).close()
        except urllib.error.HTTPError as e:
            if e.code >= 400:
                sys.exit(f"setup-listmonk: login do admin recusado ({e.code})")
        try:
            self.api("/api/settings")
        except urllib.error.HTTPError:
            sys.exit("setup-listmonk: login do admin recusado (confira LISTMONK_ADMIN_PASSWORD)")


def smtp_block(env, current):
    host = env.get("NEWSLETTER_SMTP_HOST", "").strip()
    block = dict(current)
    if not host:
        block.update(enabled=True, host="127.0.0.1", port=25, auth_protocol="none",
                     username="", password="", tls_type="none", max_conns=1)
        return block, False
    port = int(env.get("NEWSLETTER_SMTP_PORT", "").strip() or 587)
    tls = env.get("NEWSLETTER_SMTP_TLS", "").strip() or ("TLS" if port == 465 else "none" if port in (25, 1025) else "STARTTLS")
    user = env.get("NEWSLETTER_SMTP_USER", "").strip()
    block.update(enabled=True, host=host, port=port, username=user,
                 password=env.get("NEWSLETTER_SMTP_PASSWORD", ""),
                 auth_protocol="login" if user else "none", tls_type=tls,
                 tls_skip_verify=False, max_conns=2)
    return block, True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="painel do Listmonk (ex.: http://127.0.0.1:3135)")
    ap.add_argument("--env-file", required=True)
    ap.add_argument("--secret-file", help="grava usuário/senha do painel aqui (600)")
    ap.add_argument("--panel-url", help="URL do painel pra anotar no --secret-file")
    args = ap.parse_args()

    env = read_env(args.env_file)
    site = env.get("NEXT_PUBLIC_SERVER_URL", "").strip().rstrip("/")
    if not site:
        sys.exit("setup-listmonk: NEXT_PUBLIC_SERVER_URL vazio no --env-file")
    host = urllib.parse.urlparse(site).hostname or "localhost"
    user = env.get("LISTMONK_ADMIN_USER", "").strip() or "admin"
    password = env.get("LISTMONK_ADMIN_PASSWORD", "") or "listmonk-dev-admin"

    lm = Listmonk(args.url)
    lm.wait()
    lm.login(user, password)

    settings = lm.api("/api/settings")
    smtp, has_smtp = smtp_block(env, (settings.get("smtp") or [{}])[0])
    sender = env.get("NEWSLETTER_FROM", "").strip() or f'"Pronto, Falei!" <newsletter@{host}>'
    wanted = {
        "app.site_name": LIST_NAME,
        "app.root_url": f"{site}/newsletter",
        "app.logo_url": f"{site}/marca.svg",
        "app.favicon_url": f"{site}/marca.svg",
        "app.from_email": sender,
        "app.notify_emails": [],
        "app.lang": "pt-BR",
        "app.check_updates": False,
        # a API pública de inscrição (usada pelo app) depende disto; a página
        # /subscription/form do Listmonk é redirecionada pro formulário do blog
        "app.enable_public_subscription_page": True,
        "app.enable_public_archive": False,
        "app.send_optin_confirmation": True,
        "app.show_optin_page": True,
        "privacy.individual_tracking": False,
        "privacy.disable_tracking": True,
        "privacy.record_optin_ip": False,
        "privacy.unsubscribe_header": True,
        "privacy.allow_preferences": True,
        "appearance.public.custom_css": PUBLIC_CSS,
    }
    changed = any(settings.get(k) != v for k, v in wanted.items())
    old = (settings.get("smtp") or [{}])[0]
    if any(old.get(k) != smtp.get(k) for k in ("enabled", "host", "port", "username", "auth_protocol", "tls_type")):
        changed = True
    if has_smtp and smtp.get("password"):
        changed = True  # a senha volta mascarada no GET; regrava sempre que houver
    if changed:
        settings.update(wanted)
        settings["smtp"] = [smtp] + (settings.get("smtp") or [])[1:]
        lm.api("/api/settings", settings, method="PUT")
        time.sleep(3)  # o Listmonk reinicia sozinho pra aplicar
        lm.wait()
        lm.login(user, password)
        print("setup-listmonk: configurações aplicadas")
    else:
        print("setup-listmonk: configurações já estavam certas")

    lists = lm.api("/api/lists?per_page=all")["results"]
    mine = next((l for l in lists if l["name"] == LIST_NAME), None)
    if not mine:
        for l in lists:
            if l["name"] in SAMPLE_LISTS:
                lm.api(f"/api/lists/{l['id']}", method="DELETE")
        subs = lm.api("/api/subscribers?per_page=all")["results"]
        for s in subs:
            if s["email"] in SAMPLE_EMAILS:
                lm.api(f"/api/subscribers/{s['id']}", method="DELETE")
        for c in lm.api("/api/campaigns?per_page=all")["results"]:
            if c["status"] in ("draft", "cancelled", "finished") and c["name"].lower().startswith("welcome"):
                lm.api(f"/api/campaigns/{c['id']}", method="DELETE")
        mine = lm.api("/api/lists", {
            "name": LIST_NAME, "type": "public", "optin": "double", "status": "active",
            "tags": ["blog"], "description": "Textos novos do blog, por e-mail.",
        })
        print("setup-listmonk: lista criada (exemplos da instalação removidos)")
    if env.get("LISTMONK_LIST_UUID", "") != mine["uuid"]:
        set_env(args.env_file, "LISTMONK_LIST_UUID", mine["uuid"])
        print("setup-listmonk: LISTMONK_LIST_UUID gravado no .env")

    if args.secret_file:
        write_private(args.secret_file, "\n".join([
            "# Painel do Listmonk (newsletter): só LAN/Tailscale.",
            f"url={args.panel_url or args.url}",
            f"usuario={user}",
            f"senha={password}",
        ]) + "\n")
    print("setup-listmonk: smtp " + ("configurado" if has_smtp else "NÃO configurado (formulário oculto)"))


if __name__ == "__main__":
    main()
