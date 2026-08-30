import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import type { Request, Response, NextFunction} from "express";

export const protect = async(req:Request, res:Response, next:NextFunction) => {
    try{
        const { token } = req.cookies;
        const SECRET = process.env.JWT_SECRET || ""
        if(!token){
             return res.status(401).json({
                success: false,
                message: "Not authorized"
            });
        }

        const decoded = jwt.verify(token, SECRET) as { userId: string };

        const user = await prisma.user.findUnique({
            where:{
                id: decoded.userId
            }
        })

        if(!user){
            return res.status(401).json({
                success: false,
                message: "Not authorized"
            })
        }

        const { password: _, ...safeUser } = user;
        req.user = safeUser;
        next();

    } catch(error: any){
        logger.info(error.message, "registration error");
        return res.status(500).json({"success": false, "message":error.message})
    }
}