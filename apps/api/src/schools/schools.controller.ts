import { Controller, Get } from "@nestjs/common";
import { SchoolsService } from "./schools.service";

@Controller("schools")
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  listSchools() {
    return { schools: this.schools.listSchools() };
  }
}
