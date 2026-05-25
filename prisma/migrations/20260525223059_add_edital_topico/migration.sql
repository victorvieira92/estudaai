-- CreateTable
CREATE TABLE "EditalTopico" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "topico" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "questoes" INTEGER NOT NULL DEFAULT 0,
    "acertos" INTEGER NOT NULL DEFAULT 0,
    "erros" INTEGER NOT NULL DEFAULT 0,
    "ultimoEstudo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditalTopico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditalTopico_userId_idx" ON "EditalTopico"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EditalTopico_userId_disciplina_topico_key" ON "EditalTopico"("userId", "disciplina", "topico");

-- AddForeignKey
ALTER TABLE "EditalTopico" ADD CONSTRAINT "EditalTopico_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
