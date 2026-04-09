import { NotFoundException } from '@nestjs/common';
import { ProblemService } from './problem.service';
import { Problem } from '../schema/Problem';
import { CreateProblemDto } from '../dto/problem/create-problem.dto';

describe('ProblemService', () => {
  let service: ProblemService;

  const mockProblemModel = {
    create: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findById: jest.fn(),
  };

  const dto: CreateProblemDto = {
    code: 'A',
    title: 'Problem A',
    statement: 'Solve A',
    difficulty: 1,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    inputSpec: 'input',
    outputSpec: 'output',
    cases: [{ input: '1', output: '1', isPublic: true }],
    tags: ['math'],
  };

  const validId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProblemService(mockProblemModel as never);
  });

  it('should create problem with default private visibility', async () => {
    const created = { _id: 'p1', ...dto, visibility: 'private' };
    mockProblemModel.create.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(mockProblemModel.create).toHaveBeenCalledWith({
      ...dto,
      visibility: 'private',
    });
    expect(result).toEqual(created);
  });

  it('should keep explicit visibility on create', async () => {
    const explicitDto: CreateProblemDto = { ...dto, visibility: 'public' };
    const created = { _id: 'p2', ...explicitDto };
    mockProblemModel.create.mockResolvedValue(created);

    const result = await service.create(explicitDto);

    expect(mockProblemModel.create).toHaveBeenCalledWith(explicitDto);
    expect(result).toEqual(created);
  });

  it('should find all public problems for non-admin users', async () => {
    const aggregateExec = jest.fn().mockResolvedValue([{ _id: 'p1' }]);
    mockProblemModel.aggregate.mockReturnValue({ exec: aggregateExec });
    mockProblemModel.countDocuments.mockResolvedValue(1);

    const result = await service.findAll(2, 3, ['user']);

    expect(mockProblemModel.aggregate).toHaveBeenCalledTimes(1);
    const aggregateCalls = mockProblemModel.aggregate.mock.calls as Array<
      [
        Array<{
          $match?: unknown;
          $addFields?: unknown;
          $skip?: number;
          $limit?: number;
        }>,
      ]
    >;
    const pipeline = aggregateCalls[0][0];

    expect(pipeline[0]).toEqual({ $match: { visibility: 'public' } });
    expect(pipeline.some((s) => s.$addFields)).toBe(true);
    expect(pipeline.some((s) => s.$skip === 3)).toBe(true);
    expect(pipeline.some((s) => s.$limit === 3)).toBe(true);
    expect(mockProblemModel.countDocuments).toHaveBeenCalledWith({
      visibility: 'public',
    });
    expect(result).toEqual({
      items: [{ _id: 'p1' }],
      total: 1,
      current: 2,
      pageSize: 3,
      totalPages: 1,
    });
  });

  it('should find all problems for admin users without projection filter', async () => {
    const aggregateExec = jest
      .fn()
      .mockResolvedValue([{ _id: 'p1' }, { _id: 'p2' }]);
    mockProblemModel.aggregate.mockReturnValue({ exec: aggregateExec });
    mockProblemModel.countDocuments.mockResolvedValue(2);

    const result = await service.findAll(1, 5, ['admin']);

    const aggregateCalls = mockProblemModel.aggregate.mock.calls as Array<
      [
        Array<{
          $match?: unknown;
          $addFields?: unknown;
          $skip?: number;
          $limit?: number;
        }>,
      ]
    >;
    const pipeline = aggregateCalls[0][0];

    expect(pipeline[0]).toEqual({ $match: {} });
    expect(pipeline.some((s) => s.$addFields)).toBe(false);
    expect(mockProblemModel.countDocuments).toHaveBeenCalledWith({});
    expect(result.totalPages).toBe(1);
  });

  it('should find one public problem for non-admin', async () => {
    const problem = { _id: validId, visibility: 'public' } as Problem;
    const aggregateExec = jest.fn().mockResolvedValue([problem]);
    mockProblemModel.aggregate.mockReturnValue({ exec: aggregateExec });

    const result = await service.findOne(validId, ['user']);

    expect(result).toEqual(problem);
  });

  it('should throw when problem is missing in findOne', async () => {
    const aggregateExec = jest.fn().mockResolvedValue([]);
    mockProblemModel.aggregate.mockReturnValue({ exec: aggregateExec });

    await expect(service.findOne(validId, ['user'])).rejects.toThrow(
      new NotFoundException('Problem not found'),
    );
  });

  it('should throw when non-admin tries to access private problem', async () => {
    const problem = { _id: validId, visibility: 'private' } as Problem;
    const aggregateExec = jest.fn().mockResolvedValue([problem]);
    mockProblemModel.aggregate.mockReturnValue({ exec: aggregateExec });

    await expect(service.findOne(validId, ['user'])).rejects.toThrow(
      new NotFoundException("You don't have permission to view this problem"),
    );
  });

  it('should allow admin to access private problem', async () => {
    const problem = { _id: validId, visibility: 'private' } as Problem;
    const aggregateExec = jest.fn().mockResolvedValue([problem]);
    mockProblemModel.aggregate.mockReturnValue({ exec: aggregateExec });

    const result = await service.findOne(validId, ['superadmin']);

    expect(result).toEqual(problem);
  });

  it('should update an existing problem', async () => {
    const updated = { _id: validId, ...dto };
    mockProblemModel.findByIdAndUpdate.mockResolvedValue(updated);

    const result = await service.update(validId, dto);

    expect(mockProblemModel.findByIdAndUpdate).toHaveBeenCalledWith(
      validId,
      dto,
      {
        new: true,
        runValidators: true,
      },
    );
    expect(result).toEqual(updated);
  });

  it('should throw when updating missing problem', async () => {
    mockProblemModel.findByIdAndUpdate.mockResolvedValue(null);

    await expect(service.update(validId, dto)).rejects.toThrow(
      new NotFoundException('Problem not found'),
    );
  });

  it('should delete an existing problem', async () => {
    const deleted = { _id: validId };
    mockProblemModel.findByIdAndDelete.mockResolvedValue(deleted);

    const result = await service.delete(validId);

    expect(mockProblemModel.findByIdAndDelete).toHaveBeenCalledWith(validId);
    expect(result).toEqual(deleted);
  });

  it('should throw when deleting missing problem', async () => {
    mockProblemModel.findByIdAndDelete.mockResolvedValue(null);

    await expect(service.delete(validId)).rejects.toThrow(
      new NotFoundException('Problem not found'),
    );
  });

  it('should throw in findOneComplete when user lacks admin role', async () => {
    await expect(service.findOneComplete(validId, ['user'])).rejects.toThrow(
      new NotFoundException(
        'Insufficient permissions to access complete problem data',
      ),
    );
  });

  it('should throw in findOneComplete when admin cannot find problem', async () => {
    mockProblemModel.findById.mockResolvedValue(null);

    await expect(service.findOneComplete(validId, ['admin'])).rejects.toThrow(
      new NotFoundException('Problem not found'),
    );
  });

  it('should return complete problem for admin', async () => {
    const problem = { _id: validId, visibility: 'private', cases: [] };
    mockProblemModel.findById.mockResolvedValue(problem);

    const result = await service.findOneComplete(validId, ['admin']);

    expect(mockProblemModel.findById).toHaveBeenCalledWith(validId);
    expect(result).toEqual(problem);
  });
});
