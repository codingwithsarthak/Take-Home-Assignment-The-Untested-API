const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('Task API', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    it('returns all tasks when no filters are provided', async () => {
      const first = taskService.create({ title: 'Task 1', priority: 'low' });
      const second = taskService.create({ title: 'Task 2', status: 'in_progress' });

      const res = await request(app).get('/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((task) => task.id)).toEqual([first.id, second.id]);
    });

    it('returns an empty array when there are no tasks', async () => {
      const res = await request(app).get('/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /tasks with status filtering', () => {
    it('returns only tasks matching the requested status', async () => {
      taskService.create({ title: 'Todo 1', status: 'todo' });
      taskService.create({ title: 'Todo 2', status: 'todo' });
      taskService.create({ title: 'In progress', status: 'in_progress' });

      const res = await request(app).get('/tasks?status=todo');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((task) => task.status === 'todo')).toBe(true);
    });

    it('returns an empty array when the requested status has no matches', async () => {
      taskService.create({ title: 'Done task', status: 'done' });

      const res = await request(app).get('/tasks?status=todo');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /tasks with pagination', () => {
    it('returns the correct page for valid page and limit values', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });
      taskService.create({ title: 'Task 4' });
      taskService.create({ title: 'Task 5' });

      const res = await request(app).get('/tasks?page=2&limit=2');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((task) => task.title)).toEqual(['Task 3', 'Task 4']);
    });

    it('defaults to page 1 and limit 10 when query params are missing or invalid', async () => {
      const tasks = Array.from({ length: 12 }, (_, index) =>
        taskService.create({ title: `Task ${index + 1}` })
      );

      const res = await request(app).get('/tasks?page=NaN&limit=0');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(10);
      expect(res.body.map((task) => task.id)).toEqual(tasks.slice(0, 10).map((task) => task.id));
    });
  });

  describe('POST /tasks', () => {
    it('creates a new task with default values', async () => {
      const payload = { title: 'Write tests', description: 'Add API coverage' };

      const res = await request(app).post('/tasks').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Write tests',
        description: 'Add API coverage',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        completedAt: null,
      });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.createdAt).toEqual(expect.any(String));
    });

    it('returns 400 when title is missing or blank', async () => {
      const res = await request(app).post('/tasks').send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required and must be a non-empty string');
    });

    it('returns 400 for an invalid status', async () => {
      const res = await request(app).post('/tasks').send({ title: 'Bad status', status: 'archived' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('status must be one of: todo, in_progress, done');
    });

    it('returns 400 for an invalid priority', async () => {
      const res = await request(app).post('/tasks').send({ title: 'Bad priority', priority: 'urgent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('priority must be one of: low, medium, high');
    });

    it('returns 400 for an invalid dueDate', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Bad due date',
        dueDate: 'not-a-date',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('updates an existing task and returns the updated task', async () => {
      const created = taskService.create({ title: 'Old title', status: 'todo' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({ title: 'New title', status: 'in_progress', priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.id,
        title: 'New title',
        status: 'in_progress',
        priority: 'high',
      });
    });

    it('returns 400 when update payload is invalid', async () => {
      const created = taskService.create({ title: 'Old title' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title must be a non-empty string');
    });

    it('returns 404 when the task does not exist', async () => {
      const res = await request(app)
        .put('/tasks/missing-id')
        .send({ title: 'Ghost task' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('deletes an existing task and returns 204', async () => {
      const created = taskService.create({ title: 'Delete me' });

      const res = await request(app).delete(`/tasks/${created.id}`);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(taskService.findById(created.id)).toBeUndefined();
    });

    it('returns 404 when the task does not exist', async () => {
      const res = await request(app).delete('/tasks/missing-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    it('assigns a task to a person and persists the assignee', async () => {
      const created = taskService.create({ title: 'Assign me', assignee: null });

      const res = await request(app)
        .patch(`/tasks/${created.id}/assign`)
        .send({ assignee: 'Sarthak' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.id,
        title: 'Assign me',
        assignee: 'Sarthak',
      });

      const persisted = taskService.findById(created.id);
      expect(persisted.assignee).toBe('Sarthak');
    });

    it('returns 404 when the task does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/missing-id/assign')
        .send({ assignee: 'Sarthak' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('returns 400 when assignee is missing', async () => {
      const created = taskService.create({ title: 'No assignee' });

      const res = await request(app)
        .patch(`/tasks/${created.id}/assign`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('returns 400 when assignee is an empty string', async () => {
      const created = taskService.create({ title: 'Empty assignee' });

      const res = await request(app)
        .patch(`/tasks/${created.id}/assign`)
        .send({ assignee: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('returns 400 when assignee is whitespace only', async () => {
      const created = taskService.create({ title: 'Whitespace assignee' });

      const res = await request(app)
        .patch(`/tasks/${created.id}/assign`)
        .send({ assignee: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('returns 400 when assignee is not a string', async () => {
      const created = taskService.create({ title: 'Non-string assignee' });

      const res = await request(app)
        .patch(`/tasks/${created.id}/assign`)
        .send({ assignee: 123 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('reassigns an already-assigned task by replacing the current assignee', async () => {
      const created = taskService.create({ title: 'Already assigned', assignee: 'Alice' });

      const res = await request(app)
        .patch(`/tasks/${created.id}/assign`)
        .send({ assignee: 'Bob' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');

      const persisted = taskService.findById(created.id);
      expect(persisted.assignee).toBe('Bob');
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('marks a task complete and returns the updated task', async () => {
      const created = taskService.create({ title: 'Finish this', priority: 'high' });

      const res = await request(app).patch(`/tasks/${created.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.id,
        status: 'done',
        priority: 'medium',
        completedAt: expect.any(String),
      });
    });

    it('returns 404 when the task does not exist', async () => {
      const res = await request(app).patch('/tasks/missing-id/complete');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('GET /tasks/stats', () => {
    it('returns counts by status and overdue total', async () => {
      const cutoff = Date.now();
      const overduePast = new Date(cutoff - 2 * 24 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(cutoff + 2 * 24 * 60 * 60 * 1000).toISOString();

      taskService.create({ title: 'Todo overdue', status: 'todo', dueDate: overduePast });
      taskService.create({ title: 'Todo future', status: 'todo', dueDate: futureDate });
      taskService.create({ title: 'In progress overdue', status: 'in_progress', dueDate: overduePast });
      taskService.create({ title: 'Done overdue', status: 'done', dueDate: overduePast });

      const res = await request(app).get('/tasks/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 2,
        in_progress: 1,
        done: 1,
        overdue: 2,
      });
    });

    it('returns zeros when no tasks exist', async () => {
      const res = await request(app).get('/tasks/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });
  });
});
