const taskService = require('../src/services/taskService');

describe('taskService', () => {
  beforeEach(() => {
    taskService._reset();
  });

  it('creates a task with default values and generated metadata', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toEqual(expect.any(String));
  });

  it('finds a task by id', () => {
    const created = taskService.create({ title: 'First task' });

    expect(taskService.findById(created.id)).toEqual(created);
    expect(taskService.findById('missing-id')).toBeUndefined();
  });

  it('returns all tasks in creation order', () => {
    const first = taskService.create({ title: 'First task' });
    const second = taskService.create({ title: 'Second task' });

    expect(taskService.getAll()).toEqual([first, second]);
  });

  it('filters tasks by status', () => {
    taskService.create({ title: 'Todo 1', status: 'todo' });
    taskService.create({ title: 'In progress', status: 'in_progress' });
    taskService.create({ title: 'Done', status: 'done' });

    expect(taskService.getByStatus('todo')).toHaveLength(1);
    expect(taskService.getByStatus('in_progress')).toHaveLength(1);
    expect(taskService.getByStatus('done')).toHaveLength(1);
    expect(taskService.getByStatus('missing')).toEqual([]);
  });

  it('returns the correct page slice for pagination', () => {
    taskService.create({ title: 'Task 1' });
    taskService.create({ title: 'Task 2' });
    taskService.create({ title: 'Task 3' });
    taskService.create({ title: 'Task 4' });
    taskService.create({ title: 'Task 5' });

    expect(taskService.getPaginated(2, 2)).toHaveLength(2);
    expect(taskService.getPaginated(2, 2).map((task) => task.title)).toEqual(['Task 3', 'Task 4']);
  });

  it('calculates counts and overdue values correctly', () => {
    const now = Date.now();
    const overduePast = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();

    taskService.create({ title: 'Overdue todo', status: 'todo', dueDate: overduePast });
    taskService.create({ title: 'Future todo', status: 'todo', dueDate: futureDate });
    taskService.create({ title: 'Overdue in progress', status: 'in_progress', dueDate: overduePast });
    taskService.create({ title: 'Done task', status: 'done', dueDate: overduePast });

    expect(taskService.getStats()).toEqual({
      todo: 2,
      in_progress: 1,
      done: 1,
      overdue: 2,
    });
  });

  it('updates an existing task with supplied fields', () => {
    const created = taskService.create({ title: 'Original title', status: 'todo' });

    const updated = taskService.update(created.id, {
      title: 'Updated title',
      priority: 'high',
      status: 'in_progress',
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: 'Updated title',
      priority: 'high',
      status: 'in_progress',
    });
    expect(taskService.findById(created.id)).toMatchObject({
      title: 'Updated title',
      status: 'in_progress',
    });
  });

  it('returns null when trying to update a missing task', () => {
    expect(taskService.update('missing-id', { title: 'Nope' })).toBeNull();
  });

  it('removes a task and returns true', () => {
    const created = taskService.create({ title: 'Delete me' });

    expect(taskService.remove(created.id)).toBe(true);
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns false when removing a missing task', () => {
    expect(taskService.remove('missing-id')).toBe(false);
  });

  it('marks a task as complete and sets completion metadata', () => {
    const created = taskService.create({ title: 'Complete me', priority: 'high' });

    const updated = taskService.completeTask(created.id);

    expect(updated).toMatchObject({
      id: created.id,
      status: 'done',
      priority: 'medium',
      completedAt: expect.any(String),
    });
    expect(taskService.findById(created.id).status).toBe('done');
  });

  it('returns null when completing a missing task', () => {
    expect(taskService.completeTask('missing-id')).toBeNull();
  });
});
