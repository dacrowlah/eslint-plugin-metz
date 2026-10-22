import { tagged } from './tag.ts';

export const DEMETER_SELECTORS = [
  {
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.object.type='MemberExpression'][callee.object.object.type='MemberExpression']",
    message: tagged(
      'demeter/chain',
      'Law of Demeter: a.b.c.method() reaches through objects. Ask your direct collaborator.',
    ),
  },
  {
    selector: "MemberExpression[object.type='CallExpression'][object.callee.name=/^use[A-Z]/]",
    message: tagged(
      'demeter/hook-reach',
      'Do not reach through a hook result; destructure the one dependency you need in a VM hook.',
    ),
  },
];
