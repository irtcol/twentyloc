import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { join } from 'path';

import { Repository } from 'typeorm';

import { INDEX_FILE_NAME } from 'src/engine/core-modules/serverless/drivers/constants/index-file-name';
import { SERVERLESS_FUNCTION_PUBLISHED } from 'src/engine/metadata-modules/serverless-function/constants/serverless-function-published';
import { ServerlessFunctionEntity } from 'src/engine/metadata-modules/serverless-function/serverless-function.entity';
import { ServerlessFunctionService } from 'src/engine/metadata-modules/serverless-function/serverless-function.service';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event.type';
import { CodeIntrospectionService } from 'src/modules/code-introspection/code-introspection.service';
import { OnCustomBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-custom-batch-event.decorator';

@Injectable()
export class ServerlessFunctionPublicationListener {
  constructor(
    private readonly serverlessFunctionService: ServerlessFunctionService,
    private readonly codeIntrospectionService: CodeIntrospectionService,
    @InjectRepository(ServerlessFunctionEntity, 'metadata')
    private readonly serverlessFunctionRepository: Repository<ServerlessFunctionEntity>,
  ) {}

  @OnCustomBatchEvent(SERVERLESS_FUNCTION_PUBLISHED)
  async handle(
    batchEvent: WorkspaceEventBatch<{
      serverlessFunctionId: string;
      serverlessFunctionVersion: string;
    }>,
  ): Promise<void> {
    for (const event of batchEvent.events) {
      const sourceCode =
        await this.serverlessFunctionService.getServerlessFunctionSourceCode(
          batchEvent.workspaceId,
          event.serverlessFunctionId,
          event.serverlessFunctionVersion,
        );

      if (!sourceCode) {
        return;
      }

      const indexCode = sourceCode[join('src', INDEX_FILE_NAME)];

      if (!indexCode) {
        return;
      }

      const latestVersionInputSchema =
        this.codeIntrospectionService.getFunctionInputSchema(indexCode);

      await this.serverlessFunctionRepository.update(
        { id: event.serverlessFunctionId },
        { latestVersionInputSchema },
      );
    }
  }
}
