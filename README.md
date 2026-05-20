# accessmonitor-docker
AccessMonitor Docker

Para Correr criar o .env com as propriedades descritas no .env.example e correr

docker build -t accessmonitor-docker
docker run --env-file .env -p 3000:3000 accessmonitor-docker

**Nota 20/05/2026** - para além do servidor da ARTE, I.P, com a _<span lang="en">dockerização</span>_, o AccessMonitor passa a poder ser instalado onde quiser. Na sua máquina local, na sua rede local, na sua intranet, como apoio ao seu <abbr title="Content Management System">CMS</abbr>, ... . Desta forma o AccessMonitor ganha graus de liberdade para avaliar ainda mais páginas, mesmo as que ainda não estão publicadas na Internet.
