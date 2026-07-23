# Segurança

- Não publique o arquivo `.env`.
- Use uma `SESSION_SECRET` aleatória com no mínimo 32 caracteres.
- O PIN padrão solicitado é `3007`. Para ambiente público, proteja o serviço com autenticação corporativa, VPN ou controle de acesso no proxy.
- Ative HTTPS no provedor de hospedagem.
- Mantenha Node.js e a dependência `pg` atualizados.
- Relate vulnerabilidades diretamente ao responsável pelo repositório, sem abrir uma issue pública com detalhes exploráveis.
