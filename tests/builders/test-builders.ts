/**
 * Test Data Builders
 * Builder pattern for creating consistent test objects
 */

// ============================================================================
// USER BUILDER
// ============================================================================

export class UserBuilder {
  private data: any = {
    id: 1,
    email: 'test@example.com',
    tenant_id: 1,
    password_hash: 'hashed_password_123',
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  withId(id: number): UserBuilder {
    this.data.id = id;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.data.email = email;
    return this;
  }

  withTenantId(tenantId: number): UserBuilder {
    this.data.tenant_id = tenantId;
    return this;
  }

  withPassword(password: string): UserBuilder {
    this.data.password_hash = Buffer.from(password).toString('base64');
    return this;
  }

  withEmailVerified(verified: boolean): UserBuilder {
    this.data.email_verified = verified;
    return this;
  }

  build(): any {
    return { ...this.data };
  }
}

// ============================================================================
// DOCUMENT BUILDER
// ============================================================================

export class DocumentBuilder {
  private data: any = {
    id: 1,
    tenant_id: 1,
    user_id: 1,
    filename: 'test_document.pdf',
    mimetype: 'application/pdf',
    file_size: 1024,
    status: 'indexed',
    uploaded_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
    chunk_count: 10,
    error_message: null,
  };

  withId(id: number): DocumentBuilder {
    this.data.id = id;
    return this;
  }

  withTenantId(tenantId: number): DocumentBuilder {
    this.data.tenant_id = tenantId;
    return this;
  }

  withUserId(userId: number): DocumentBuilder {
    this.data.user_id = userId;
    return this;
  }

  withFilename(filename: string): DocumentBuilder {
    this.data.filename = filename;
    return this;
  }

  withMimetype(mimetype: string): DocumentBuilder {
    this.data.mimetype = mimetype;
    return this;
  }

  withStatus(status: string): DocumentBuilder {
    this.data.status = status;
    return this;
  }

  withChunkCount(count: number): DocumentBuilder {
    this.data.chunk_count = count;
    return this;
  }

  build(): any {
    return { ...this.data };
  }
}

// ============================================================================
// CHUNK BUILDER
// ============================================================================

export class ChunkBuilder {
  private data: any = {
    id: '1:0',
    document_id: 1,
    tenant_id: 1,
    chunk_index: 0,
    content: 'This is a sample chunk of text from the document.',
    embedding: new Array(3072).fill(0).map(() => Math.random()),
    created_at: new Date().toISOString(),
  };

  withId(id: string): ChunkBuilder {
    this.data.id = id;
    return this;
  }

  withDocumentId(documentId: number): ChunkBuilder {
    this.data.document_id = documentId;
    return this;
  }

  withTenantId(tenantId: number): ChunkBuilder {
    this.data.tenant_id = tenantId;
    return this;
  }

  withChunkIndex(index: number): ChunkBuilder {
    this.data.chunk_index = index;
    this.data.id = `${this.data.document_id}:${index}`;
    return this;
  }

  withContent(content: string): ChunkBuilder {
    this.data.content = content;
    return this;
  }

  withEmbedding(embedding: number[]): ChunkBuilder {
    this.data.embedding = embedding;
    return this;
  }

  build(): any {
    return { ...this.data };
  }
}
