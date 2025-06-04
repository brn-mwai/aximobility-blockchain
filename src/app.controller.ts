import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    @ApiOperation({ summary: 'Get application information' })
    @ApiResponse({ status: 200, description: 'Returns application info' })
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('health')
    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({ status: 200, description: 'Returns health status' })
    getHealth() {
        return this.appService.getHealth();
    }

    @Get('version')
    @ApiOperation({ summary: 'Get application version' })
    @ApiResponse({ status: 200, description: 'Returns version information' })
    getVersion() {
        return this.appService.getVersion();
    }
}