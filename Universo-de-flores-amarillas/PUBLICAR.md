# Publicar en GitHub y Vercel

## 1. Crear el repositorio en GitHub

En GitHub, crea un repositorio nuevo y vacío. No marques las opciones para añadir README, `.gitignore` o licencia, porque el proyecto ya incluye esos archivos.

## 2. Subir el proyecto

Abre PowerShell en esta carpeta y ejecuta:

```powershell
git add .
git commit -m "Preparar universo de flores amarillas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/NOMBRE-DEL-REPOSITORIO.git
git push -u origin main
```

Sustituye `TU-USUARIO` y `NOMBRE-DEL-REPOSITORIO` por los datos de tu repositorio.

Si ya configuraste un remoto llamado `origin`, usa esto para cambiarlo:

```powershell
git remote set-url origin https://github.com/TU-USUARIO/NOMBRE-DEL-REPOSITORIO.git
```

## 3. Desplegar en Vercel

1. Entra a <https://vercel.com/new> e inicia sesión con GitHub.
2. Selecciona **Import** junto al repositorio.
3. Vercel leerá automáticamente `vercel.json`.
4. Confirma que **Build Command** sea `npm run build` y **Output Directory** sea `dist`.
5. Pulsa **Deploy**.

Cada nuevo `git push` a la rama `main` actualizará el sitio en Vercel.
