import express from "express";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 8000

const app = express();

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.listen(PORT, () => {
    console.log(`Server started ob port ${PORT}`);
})