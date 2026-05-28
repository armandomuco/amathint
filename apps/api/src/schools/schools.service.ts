import { Injectable } from "@nestjs/common";
import fs from "fs";
import path from "path";

export type SchoolRecord = {
  id: string;
  name: string;
  qark: string;
  city: string;
  level: "primary" | "high";
};

@Injectable()
export class SchoolsService {
  private readonly schools = this.loadSchools();

  listSchools() {
    return this.schools;
  }

  findById(id: string | undefined) {
    if (!id) return null;
    return this.schools.find((school) => school.id === id) || null;
  }

  private loadSchools(): SchoolRecord[] {
    const sourcePath = path.join(process.cwd(), "src/schools/albania-schools.json");
    const fallbackPath = path.join(__dirname, "albania-schools.json");
    const filePath = fs.existsSync(sourcePath) ? sourcePath : fallbackPath;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as SchoolRecord[];
  }
}
