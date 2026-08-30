import "dotenv/config"
import jwt from "jsonwebtoken"

export const generateToken = (userId: string) => {
    const JWT_SECRET = process.env.JWT_SECRET || " ";
    return jwt.sign({userId}, JWT_SECRET, { expiresIn: "7d" });    
}