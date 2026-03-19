import express from "express";
import peopleRouter from "../people.js";

const router = express.Router();

// Alias legacy temporaire:
// /employees/* -> /people/employees/*
router.use((req, res, next) => {
  const originalUrl = req.url;
  const suffix = originalUrl === "/" ? "" : originalUrl;
  req.url = `/employees${suffix}`;

  peopleRouter.handle(req, res, (err) => {
    req.url = originalUrl;
    if (err) return next(err);
    return next();
  });
});

export default router;
