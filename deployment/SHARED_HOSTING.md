# ChurchAdmin en hosting administrado con MySQL

Este paquete requiere que el panel del hosting permita ejecutar una aplicacion Node.js 20 o posterior. No funciona como sitio HTML/PHP estatico.

## Instalacion sin SSH

1. Cree una base de datos MySQL 8 y un usuario con permisos completos sobre ella.
2. Importe `mysql-schema.sql` y después `mysql-initial-data.sql` desde phpMyAdmin o la herramienta equivalente del panel.
3. Descomprima todo el paquete en el directorio asignado a la aplicacion Node.js.
4. Configure `server.js` como archivo de inicio y `NODE_ENV=production`.
5. Copie las variables de `.env.example` al administrador de variables del hosting. Este archivo contiene secretos generados exclusivamente para el paquete.
6. Cambie `DATABASE_URL`, secretos y `PUBLIC_APP_URL` por los valores reales.
7. Conceda escritura persistente a `storage/media` y `storage/exports`.
8. Inicie o reinicie la aplicacion desde el panel.

El comando equivalente de inicio es `node server.js`. El puerto lo proporciona el hosting mediante la variable `PORT`; no debe fijarse manualmente.

## Primer acceso

Las credenciales temporales se encuentran en `INSTALLATION-CREDENTIALS.txt`. El administrador esta marcado para cambiar la contrasena en el primer acceso. Elimine ese archivo localmente y del hosting despues de confirmar el acceso.

## Limitaciones del hosting

- La aplicacion necesita un proceso Node.js persistente para Server Actions, autenticacion, APIs y webhooks.
- Los archivos multimedia y exportaciones necesitan almacenamiento persistente y escribible.
- Los workers se ejecutan dentro del proceso web con las variables incluidas. Un hosting que suspenda procesos inactivos puede retrasar campañas y exportaciones.
- WhatsApp requiere una URL HTTPS publica y estable para el webhook.
