# ChurchAdmin en hosting administrado con MySQL

Este paquete requiere que el panel del hosting permita ejecutar una aplicacion Node.js persistente (minimo 20.9; use Node.js 22 para coincidir con el entorno Docker del proyecto). No funciona como sitio HTML/PHP estatico. Para PostgreSQL o un servidor con Docker, consulte la [guia de produccion](PRODUCTION.md).

## Crear un paquete para otra iglesia

Estos pasos los realiza quien prepara la distribucion, en una copia del repositorio con Node.js 22 y npm. El destinatario recibe el ZIP resultante; no necesita compilarlo en el panel:

```bash
npm ci
PACKAGE_CHURCH_NAME="Mi Iglesia" \
PACKAGE_CHURCH_SLUG="mi-iglesia" \
PACKAGE_ADMIN_EMAIL="admin@mi-iglesia.example" \
npm run package:mysql
```

El resultado es `dist-hosting/churchadmin-mysql.zip`. Incluye `server.js`, archivos publicos, esquema MySQL, datos iniciales de una iglesia sin personas/servicios de demostracion, configuracion y credenciales temporales. El script genera contrasenas y secretos nuevos en cada ejecucion; no use el mismo paquete como configuracion compartida entre iglesias. El comando reemplaza el directorio `dist-hosting` de una compilacion anterior: guarde antes cualquier paquete que necesite conservar.

La compilacion requiere acceso a npm y a los binarios de Prisma. El paquete incorpora Sharp para Linux x64 con glibc y un motor Prisma `debian-openssl-3.0.x`; confirme que el hosting es compatible. ARM, Alpine/musl u otro entorno nativo pueden requerir una compilacion adaptada.

Transfiera el ZIP de forma privada: contiene `.env.example` con secretos reales para esta instalacion y `INSTALLATION-CREDENTIALS.txt`. Conserve una copia segura de esos secretos para recuperacion. Los enlaces a `PRODUCTION.md` de esta guia corresponden al repositorio fuente; el paquete incluye esta guia como `LEEME.md`.

ChurchAdmin no es solamente un conjunto de paginas que el servidor entrega como archivos. Necesita mantener un proceso Node.js activo para iniciar sesion, consultar MySQL, procesar formularios, ejecutar las APIs, recibir webhooks y generar archivos. Tener PHP, MySQL o acceso al administrador de archivos no significa automaticamente que el plan incluya Node.js.

## Como comprobar si el hosting es compatible

### Opcion 1: revisar el panel

Busque alguna de estas opciones en cPanel, Plesk o el panel de su proveedor:

- `Setup Node.js App`, `Node.js Selector` o `Node.js Applications`.
- `Application Manager`, `Passenger` o `Application Server` con soporte para Node.js.
- Una opcion para seleccionar Node.js 22 (minimo compatible: 20.9).
- Campos para indicar el directorio de la aplicacion, el archivo de inicio y variables de entorno.
- Un boton para iniciar, reiniciar o detener la aplicacion.

El panel debe proporcionar automaticamente la variable `PORT`. ChurchAdmin usa ese puerto y no necesita que usted elija uno manualmente.

Si el panel solo muestra administrador de archivos, dominios, PHP, WordPress y bases de datos, pero ninguna herramienta para aplicaciones Node.js, probablemente el plan no es compatible. Confirme con soporte antes de subir el paquete completo.

### Opcion 2: comprobarlo por SSH

Si el hosting ofrece una terminal o acceso SSH, ejecute:

```bash
node --version
npm --version
```

`node --version` debe responder una version compatible (minimo `v20.9.0`; use `v22.x` para coincidir con el entorno Docker). Que el comando exista es una buena señal, pero tambien debe confirmar que el proveedor permite mantener una aplicacion Node.js ejecutandose permanentemente y conectarla a un dominio.

Puede enviar esta pregunta exacta al proveedor:

> ¿Mi plan permite ejecutar permanentemente una aplicacion Node.js 20 o 22, definir `server.js` como archivo de inicio, configurar variables de entorno, usar el puerto proporcionado en `PORT` y conectar la aplicacion a un dominio con HTTPS?

Ademas de Node.js, el plan necesita MySQL 8, HTTPS, variables de entorno y almacenamiento persistente con permiso de escritura. Para multimedia y exportaciones, confirme tambien los limites de espacio, tamaño de subida y tiempo de ejecucion.

## Instalacion sin SSH

1. Cree una base de datos MySQL 8 y un usuario con permisos completos sobre ella.
2. Importe `mysql-schema.sql` y después `mysql-initial-data.sql` desde phpMyAdmin o la herramienta equivalente del panel.
3. Descomprima todo el paquete en el directorio asignado a la aplicacion Node.js.
4. Configure `server.js` como archivo de inicio y `NODE_ENV=production`.
5. Copie las variables de `.env.example` al administrador de variables del hosting. Este archivo contiene secretos generados exclusivamente para el paquete.
6. Cambie `DATABASE_URL` y `PUBLIC_APP_URL` por los valores reales de esta instalacion. Configure `PUBLIC_APP_URL` como origen HTTPS sin ruta al final. Conserve el `PASSWORD_SECRET` generado: la contrasena del administrador del SQL inicial depende de ese valor y no podra iniciar sesion si lo cambia. Conserve tambien el `CHURCH_SLUG` que coincide con el SQL. Guarde los demas secretos generados y adapte SMTP y las integraciones si corresponde.
7. Conceda escritura persistente a `storage/media` y `storage/exports`.
8. Inicie o reinicie la aplicacion desde el panel.

Importe los dos archivos SQL solo en una base de datos nueva y vacia. No los use para actualizar una instalacion existente: el esquema no es una migracion incremental. La aplicacion MySQL empaquetada no ejecuta las migraciones PostgreSQL del repositorio.

El comando equivalente de inicio es `node server.js`. El puerto lo proporciona el hosting mediante la variable `PORT`; no debe fijarse manualmente. Las variables deben estar disponibles para el proceso Node.js: dejar solamente `.env.example` en el disco no las configura.

## Primer acceso

Abra `https://SU_DOMINIO/login`. Las credenciales temporales se encuentran en `INSTALLATION-CREDENTIALS.txt`. El administrador esta marcado para cambiar la contrasena en el primer acceso. Elimine ese archivo de las copias de trabajo y del hosting despues de confirmar el acceso.

Compruebe `https://SU_DOMINIO/api/health`: debe responder HTTP 200 con `{"status":"ok"}`. Ademas pruebe crear un servicio, subir un archivo, generar y descargar una exportacion y reiniciar la aplicacion sin perder el archivo. Si usa correo o comunicaciones, pruebe una entrega controlada. El health check no comprueba estos flujos ni la existencia de la iglesia.

## Copias de seguridad y actualizaciones

Configure copias periodicas de MySQL y de `storage/media` y `storage/exports`, junto con una copia segura separada de las variables y secretos. Guarde una copia fuera del hosting y pruebe restaurarla en una instalacion aislada. Los scripts `backup.sh` y `restore.sh` del repositorio requieren Docker/PostgreSQL y no sirven para este paquete.

Antes de una actualizacion, detenga la aplicacion, respalde base de datos y archivos, conserve sus secretos y almacenamiento, y planifique los cambios de esquema MySQL por separado. No reimporte `mysql-initial-data.sql` ni reemplace los secretos con los de un paquete nuevo: pertenecen a la instalacion original. Volver al codigo anterior no revierte cambios de base de datos.

## Limitaciones del hosting

- La aplicacion necesita un proceso Node.js persistente para Server Actions, autenticacion, APIs y webhooks.
- Los archivos multimedia y exportaciones necesitan almacenamiento persistente y escribible.
- Los workers se ejecutan dentro del proceso web con las variables incluidas. Un hosting que suspenda procesos inactivos puede retrasar campañas y exportaciones.
- WhatsApp requiere una URL HTTPS publica y estable para el webhook.
