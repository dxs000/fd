import type {Request, Response, NextFunction} from "express"

export const authorize =(...roles) => {
    return (req:Request,res:Response,next:NextFunction) => {
        if(!roles.includes(req.user?.role)){
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this resource"
            })
        }

        next();
    }
}