UPDATE "Subject" SET "wrongQuestions" = (SELECT COALESCE(SUM(p."wrongQuestions"), 0) FROM "Topic" t JOIN "Pdf" p ON p."topicId" = t.id WHERE t."subjectId" = "Subject".id) 
