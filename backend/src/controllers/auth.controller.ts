import { cons } from './../../node_modules/effect/src/List';
import { error } from './../../node_modules/ajv/lib/vocabularies/applicator/dependencies';
import bcrypt from "bcryptjs";
import type {Response, Request} from "express";
import { generateToken } from "../lib/generateToken";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";


export const registerUser = async(req:Request, res:Response) => {
    try{
        const {name, email, password, role} = req.body;
        if(!name || !email || !password){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const existingUser = await prisma.user.findUnique({
            where:{
                email
            }
        });

        if(existingUser){
            return res.status(400).json({
                success: false,
                message: "User alreay exists with this email"
            });
        }
    
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data:{
                name,
                email,
                password: hashedPassword,
                role
            }
        });

        const token = generateToken(user.id);

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite:"strict",
            maxAge: 7*24*60*60*1000
        });

        res.status(201).json({
            success:true,
            message: "Account create sucessfully",
            user: {
                id:user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch(error:any){
        logger.info(error.message, "registration error");
        return res.status(500).json({"success": false, "message":error.message})
    }
}

export const loginUser = async(req:Request, res:Response) => {
    try{
        const {email, password} = req.body;
        if(!email || !password){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const user = await prisma.user.findUnique({
            where:{
                email
            }
        });

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User does not exists"
            });
        }
    
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if(!isPasswordValid){
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = generateToken(user.id);

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite:"strict",
            maxAge: 7*24*60*60*1000
        });

        res.status(200).json({
            success:true,
            message: "Login sucessfull",
            user: {
                id:user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch(error:any){
        logger.info(error.message, "registration error");
        return res.status(500).json({"success": false, "message":error.message})
    }
}

export const logoutUser = async (req:Request, res:Response) => {
    try{
        res.cookie("token", "", {
            httpOnly: true,
            expires: new Date(0)
        });
        res.status(200).json({
            success: true,
            message: "Logged out sucessfully"
        });
    } catch(error:any){
        logger.info(error.message, "registration error");
        return res.status(500).json({"success": false, "message":error.message})
    }
}

export const getMe = async(req:Request, res:Response) => {
    try{
        res.status(200).json({success: true, user: req.user})
    } catch(error: any){
        logger.info(error.message, "registration error");
        return res.status(500).json({"success": false, "message":error.message})
    }
}

