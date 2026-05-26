UPDATE "Pdf" SET "wrongQuestions" = (SELECT COALESCE(SUM(l."wrongQuestions"), 0) FROM "PdfStudyLog" l WHERE l."pdfId" = "Pdf".id) 
