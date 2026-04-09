import { Test, TestingModule } from '@nestjs/testing';
import { ProblemController } from './problem.controller';
import { ProblemService } from '../service/problem.service';
import { getModelToken } from '@nestjs/mongoose';
import { Problem } from '../schema/Problem';
import { JwtAuthGuard } from '../guard/JwtAuthGuard';
import { OptionalJwtAuthGuard } from '../guard/OptionalJwtAuthGuard';
import { RolesGuard } from '../guard/RolesGuard';
import { Request } from 'express';

describe('ProblemController', () => {
  let controller: ProblemController;

  const mockProblemModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  const mockProblemService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProblemController],
      providers: [
        {
          provide: ProblemService,
          useValue: mockProblemService,
        },
        {
          provide: getModelToken(Problem.name),
          useValue: mockProblemModel,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProblemController>(ProblemController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a problem', async () => {
    const createProblemDto = {
      code: 'A',
      title: 'Test Problem',
      statement: 'This is a test problem',
      difficulty: 5,
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      inputSpec: 'Input description',
      outputSpec: 'Output description',
      cases: [{ input: '1', output: '1', isPublic: true }],
      tags: ['test'],
      visibility: 'private' as const,
    };

    const expectedResult = { _id: '1', ...createProblemDto };
    mockProblemService.create.mockResolvedValue(expectedResult);

    const result: unknown = await controller.create(createProblemDto);

    expect(mockProblemService.create).toHaveBeenCalledWith(createProblemDto);
    expect(result).toEqual(expectedResult);
  });

  it('should get all problems with pagination', async () => {
    const expectedResult = {
      items: [],
      total: 0,
      current: 1,
      pageSize: 5,
      totalPages: 0,
    };
    mockProblemService.findAll.mockResolvedValue(expectedResult);

    const mockReq = { user: undefined } as unknown as Request;
    const result: unknown = await controller.findAll(1, 5, mockReq);

    expect(mockProblemService.findAll).toHaveBeenCalledWith(1, 5, []);
    expect(result).toEqual(expectedResult);
  });

  it('should get all problems with admin roles', async () => {
    const expectedResult = {
      items: [],
      total: 0,
      current: 1,
      pageSize: 5,
      totalPages: 0,
    };
    mockProblemService.findAll.mockResolvedValue(expectedResult);

    const mockReq = { user: { roles: ['admin'] } } as unknown as Request;
    const result: unknown = await controller.findAll(1, 5, mockReq);

    expect(mockProblemService.findAll).toHaveBeenCalledWith(1, 5, ['admin']);
    expect(result).toEqual(expectedResult);
  });

  it('should get a problem by id for unauthenticated user', async () => {
    const expectedProblem = {
      _id: '1',
      code: 'A',
      title: 'Test Problem',
      visibility: 'public',
    };
    mockProblemService.findOne.mockResolvedValue(expectedProblem);

    const mockReq = { user: undefined } as unknown as Request;
    const result: unknown = await controller.findOne('1', mockReq);

    expect(mockProblemService.findOne).toHaveBeenCalledWith('1', []);
    expect(result).toEqual(expectedProblem);
  });

  it('should get a problem by id for admin user', async () => {
    const expectedProblem = {
      _id: '1',
      code: 'A',
      title: 'Test Problem',
      visibility: 'private',
    };
    mockProblemService.findOne.mockResolvedValue(expectedProblem);

    const mockReq = { user: { roles: ['admin'] } } as unknown as Request;
    const result: unknown = await controller.findOne('1', mockReq);

    expect(mockProblemService.findOne).toHaveBeenCalledWith('1', ['admin']);
    expect(result).toEqual(expectedProblem);
  });
});
