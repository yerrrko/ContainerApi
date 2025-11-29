import { Pool } from "pg";
import { Request, Response } from "express";

export function ContainerController(pool: Pool) {
    return {
        getAll: async (req: Request, res: Response) => {
            const result = await pool.query("SELECT * FROM containers");
            res.json(result.rows);
        },

        create: async (req: Request, res: Response) => {
            const { number, type, status, zone_id } = req.body;
            const result = await pool.query(
                "INSERT INTO containers (number, type, status, zone_id) VALUES ($1, $2, $3, $4) RETURNING *",
                [number, type, status || 'new', zone_id || null]
            );
            res.status(201).json(result.rows[0]);
        },

        updateStatus: async (req: Request, res: Response) => {
            const id = Number(req.params.id);
            const { status } = req.body;
            await pool.query("UPDATE containers SET status = $1 WHERE id = $2", [status, id]);
            res.json({ message: "Status updated" });
        }
    };
}
