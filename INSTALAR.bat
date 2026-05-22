@echo off
echo ========================================
echo   EstudaAi - Instalando dependencias
echo ========================================
echo.
cd /d "%~dp0"
echo [1/3] Instalando pacotes npm...
npm install
echo.
echo [2/3] Gerando cliente Prisma...
npx prisma generate
echo.
echo [3/3] Criando tabelas no banco de dados...
npx prisma db push
echo.
echo ========================================
echo   PRONTO! Iniciando o servidor...
echo ========================================
echo.
echo Acesse: http://localhost:3000
echo.
npm run dev
