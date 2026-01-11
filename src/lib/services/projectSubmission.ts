import type { SubmittedProject } from '../supabase';

export interface ProjectSubmissionData {
  name: string;
  author: string;
  description: string;
  videoUrl?: string;
  tags?: string[];
}

export class ProjectSubmissionService {
  private supabase: any;

  constructor() {
    this.supabase = null;
  }

  async init() {
    if (typeof window !== 'undefined') {
      const { supabase } = await import('../supabase');
      this.supabase = supabase;
    }
  }

  /**
   * Upload a ZIP file to Supabase storage (anonymous)
   */
  async uploadProjectFile(file: File): Promise<string> {
    if (!this.supabase) {
      await this.init();
    }

    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    // Validate file
    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Only ZIP files are allowed');
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('File size must be less than 50MB');
    }

    // Create unique file path: anonymous/timestamp-randomid-filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    // Sanitize filename: remove/replace problematic characters
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace non-alphanumeric chars (except . and -) with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    const fileName = `anonymous/${timestamp}-${randomId}-${sanitizedFileName}`;

    // Upload to storage (works for anonymous users)
    const { data, error } = await this.supabase.storage
      .from('project-submissions')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Return the file path (not public URL since files are private)
    return data.path;
  }

  /**
   * Submit a project for review (anonymous submission)
   */
  async submitProject(
    projectData: ProjectSubmissionData,
    file: File,
    userEmail?: string
  ): Promise<void> {
    if (!this.supabase) {
      await this.init();
    }

    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    try {
      // Upload file first
      const filePath = await this.uploadProjectFile(file);

      // Insert submission record (anonymous submission)
      const submissionData = {
        name: projectData.name,
        author: projectData.author,
        author_email: userEmail,
        user_id: null, // No user ID for anonymous submissions
        description: projectData.description,
        file_url: filePath, // Store the file path, not a public URL
        video_url: projectData.videoUrl || null,
        tags: projectData.tags || [],
        file_size: file.size,
        status: 'pending'
      };

      const { error } = await this.supabase
        .from('submitted_projects')
        .insert(submissionData);

      if (error) {
        // If database insert fails, try to clean up the uploaded file
        try {
          await this.supabase.storage
            .from('project-submissions')
            .remove([filePath]);
        } catch (cleanupError) {
          console.warn('Failed to cleanup uploaded file:', cleanupError);
        }
        
        throw new Error(`Submission failed: ${error.message}`);
      }

      // Success - no data returned since user cannot view submissions
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred during submission');
    }
  }

  // Note: Anonymous users cannot view or manage their submissions
  // These functions are removed as per the policy that anonymous users
  // can only submit but not view or modify the database
}