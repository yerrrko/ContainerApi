import { Pool } from "pg";
import { Request, Response } from "express";

export function ZoneController(pool: Pool) {
    return {
        getAll: async (req: Request, res: Response) => {
            const result = await pool.query("SELECT * FROM zones");
            res.json(result.rows);
        },

        assignContainer: async (req: Request, res: Response) => {
            const zoneId = Number(req.params.id);
            const { containerId } = req.body;

            const zoneRes = await pool.query("SELECT * FROM zones WHERE id = $1", [zoneId]);
            const containerRes = await pool.query("SELECT * FROM containers WHERE id = $1", [containerId]);

            const zone = zoneRes.rows[0];
            const container = containerRes.rows[0];

            if (!zone || !container) return res.status(404).json({ error: "Zone or Container not found" });

            if (zone.current_load >= zone.capacity) {
                return res.status(400).json({ error: "Zone Overloaded" });
            }

            await pool.query("UPDATE containers SET status = 'assigned', zone_id = $1 WHERE id = $2", [zoneId, containerId]);
            await pool.query("UPDATE zones SET current_load = current_load + 1 WHERE id = $1", [zoneId]);

            res.json({ message: "Container assigned successfully" });
        }
    };
}
