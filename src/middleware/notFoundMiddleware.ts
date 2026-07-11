import { type Request, type Response } from 'express';

const notFoundMiddleware = (req: Request, res: Response): void => {
    res.status(404).json({ error: 'NotFound', message: `Cannot ${req.method} ${req.path}` });
};

export default notFoundMiddleware;
